using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        Application.EnableVisualStyles();
        string root = Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory);
        string key;
        using (SHA256 hash = SHA256.Create())
            key = BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(root.ToLowerInvariant()))).Replace("-", "").Substring(0, 24);
        bool first;
        using (EventWaitHandle open = new EventWaitHandle(false, EventResetMode.AutoReset, @"Local\OfficeOpen-" + key))
        using (EventWaitHandle stop = new EventWaitHandle(false, EventResetMode.AutoReset, @"Local\OfficeStop-" + key))
        using (Mutex mutex = new Mutex(true, @"Local\OfficeLauncher-" + key, out first))
        {
            if (!first)
            {
                if (Array.IndexOf(args, "--stop") >= 0) stop.Set();
                else if (Array.IndexOf(args, "--smoke-test") >= 0) return 2;
                else if (Array.IndexOf(args, "--no-browser") < 0) open.Set();
                return 0;
            }
            if (Array.IndexOf(args, "--stop") >= 0) return 0;
            try
            {
                using (OfficeContext context = new OfficeContext(root, open, stop,
                    Array.IndexOf(args, "--no-browser") < 0, Array.IndexOf(args, "--smoke-test") >= 0))
                {
                    Application.Run(context);
                    return context.ExitCode;
                }
            }
            catch (Exception)
            {
                if (Array.IndexOf(args, "--smoke-test") < 0)
                    MessageBox.Show("Không thể khởi động launcher. Hãy giải nén toàn bộ app vào thư mục bạn có quyền ghi.", "AI Agent Office", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
            finally { mutex.ReleaseMutex(); }
        }
    }
}

internal sealed class OfficeContext : ApplicationContext
{
    private readonly string root;
    private readonly EventWaitHandle openEvent, stopEvent;
    private readonly bool smoke;
    private bool openBrowser, ready, stopping, forceStarted, errorShown, disposed;
    private volatile bool receivedReady;
    private volatile string startupError;
    private Process backend;
    private NotifyIcon tray;
    private System.Windows.Forms.Timer timer;
    private DateTime started, stopStarted;
    private int port;
    public int ExitCode { get; private set; }

    public OfficeContext(string appRoot, EventWaitHandle open, EventWaitHandle stop, bool browser, bool smokeTest)
    {
        root = appRoot; openEvent = open; stopEvent = stop; smoke = smokeTest; openBrowser = browser && !smoke;
        string configuredPort = Environment.GetEnvironmentVariable("OFFICE_PORT");
        port = 4310;
        if (configuredPort != null && (!Int32.TryParse(configuredPort, out port) || port < 1024 || port > 65535))
            throw new InvalidOperationException("OFFICE_PORT");
        if (!File.Exists(Path.Combine(root, "dist", "server", "index.js")) || !File.Exists(Path.Combine(root, "dist", "web", "index.html")) ||
            !File.Exists(Path.Combine(root, "node_modules", "fastify", "package.json")))
            throw new FileNotFoundException("Build missing");
        // Check write access before launching: database belongs to this portable folder.
        Directory.CreateDirectory(Path.Combine(root, "data"));
        Log("STARTING");
        ContextMenuStrip menu = new ContextMenuStrip();
        menu.Items.Add("Mở Agent Office", null, delegate { OpenBrowser(); });
        menu.Items.Add("Thoát và dừng công việc", null, delegate { Stop(); });
        tray = new NotifyIcon { Icon = SystemIcons.Application, Text = "AI Agent Office - đang khởi động", ContextMenuStrip = menu, Visible = !smoke };
        tray.DoubleClick += delegate { OpenBrowser(); };
        string bundledNode = Path.Combine(root, "runtime", "node.exe");
        ProcessStartInfo info = new ProcessStartInfo
        {
            FileName = File.Exists(bundledNode) ? bundledNode : "node.exe",
            Arguments = "\"" + Path.Combine(root, "dist", "server", "index.js") + "\"",
            WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden,
            RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8
        };
        info.EnvironmentVariables["OFFICE_LAUNCHER"] = "1";
        backend = new Process { StartInfo = info };
        backend.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e)
        { if (e.Data == "OFFICE_LAUNCHER_READY:" + port) receivedReady = true; };
        backend.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e)
        {
            const string prefix = "OFFICE_LAUNCHER_ERROR:";
            if (e.Data != null && e.Data.StartsWith(prefix, StringComparison.Ordinal))
            {
                string code = e.Data.Substring(prefix.Length);
                if (code == "EADDRINUSE" || code == "INSTANCE_RUNNING" || code == "EACCES" || code == "EPERM") startupError = code;
            }
        };
        try
        {
            backend.Start();
            backend.BeginOutputReadLine(); backend.BeginErrorReadLine();
        }
        catch { tray.Dispose(); backend.Dispose(); throw; }
        started = DateTime.UtcNow;
        timer = new System.Windows.Forms.Timer { Interval = 200 };
        timer.Tick += Tick;
        timer.Start();
        Application.ApplicationExit += OnApplicationExit;
    }

    private void Tick(object sender, EventArgs e)
    {
        if (stopEvent.WaitOne(0)) Stop();
        if (openEvent.WaitOne(0)) OpenBrowser();
        if (backend.HasExited)
        {
            backend.WaitForExit(); // Drain the two asynchronous output readers.
            if (!stopping || backend.ExitCode != 0)
            {
                ExitCode = 1;
                Fail(startupError == "EADDRINUSE" ? "Cổng " + port + " đang được ứng dụng khác sử dụng. Đóng ứng dụng đó hoặc đặt OFFICE_PORT rồi mở lại."
                    : startupError == "INSTANCE_RUNNING" ? "Agent Office đang chạy bằng npm hoặc một launcher khác. Dừng phiên cũ trước khi mở launcher."
                    : "Backend không khởi động được hoặc đã dừng bất thường. Kiểm tra quyền ghi thư mục, Node.js 24 và các file đi kèm app.");
            }
            Log(ExitCode == 0 ? "STOPPED" : "BACKEND_FAILED");
            ExitThread(); return;
        }
        if (receivedReady && !ready && !stopping)
        {
            ready = true;
            tray.Text = "AI Agent Office - đang chạy";
            Log("READY");
            if (smoke) Stop(); else if (openBrowser) OpenBrowser();
        }
        if (!ready && !stopping && (DateTime.UtcNow - started).TotalSeconds > 30)
        {
            ExitCode = 1;
            Fail("App chưa sẵn sàng sau 30 giây. Launcher sẽ dừng backend; kiểm tra thư mục app rồi thử lại.");
            Stop();
        }
        if (stopping && !forceStarted && (DateTime.UtcNow - stopStarted).TotalSeconds > 30)
        {
            forceStarted = true; ExitCode = 1;
            Log("FORCED_STOP");
            try
            {
                // Only terminate the process tree created by this launcher.
                using (Process kill = Process.Start(new ProcessStartInfo
                { FileName = Path.Combine(Environment.SystemDirectory, "taskkill.exe"), Arguments = "/PID " + backend.Id + " /T /F",
                    UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden })) { }
            }
            catch { Fail("Không thể dừng backend. Hãy dùng Task Manager để dừng tiến trình Node.js của app."); }
        }
    }

    private void OpenBrowser()
    {
        if (!ready || stopping) { openBrowser = true; return; }
        try { Process.Start(new ProcessStartInfo("http://127.0.0.1:" + port) { UseShellExecute = true }); }
        catch { Fail("Không mở được trình duyệt. Mở http://127.0.0.1:" + port + " bằng trình duyệt của bạn."); }
    }

    private void Stop()
    {
        if (stopping) return;
        stopping = true; stopStarted = DateTime.UtcNow;
        tray.Text = "AI Agent Office - đang dừng";
        Log("STOPPING");
        try { backend.StandardInput.WriteLine("stop"); backend.StandardInput.Close(); }
        catch (IOException) { /* Process may already have closed its input. Tick observes exit. */ }
        catch (InvalidOperationException) { /* Process already exited. */ }
    }

    private void Fail(string message)
    {
        if (smoke || errorShown) return;
        errorShown = true;
        MessageBox.Show(message, "AI Agent Office", MessageBoxButtons.OK, MessageBoxIcon.Error);
    }

    private void Log(string code)
    {
        // Lifecycle only; never persist raw HTTP/provider output or credentials here.
        string file = Path.Combine(root, "data", "launcher.log");
        try
        {
            if (File.Exists(file) && new FileInfo(file).Length > 256 * 1024) File.WriteAllText(file, "");
            File.AppendAllText(file, DateTime.UtcNow.ToString("o") + " " + code + Environment.NewLine);
        }
        catch (IOException) { if (code == "STARTING") throw; }
        catch (UnauthorizedAccessException) { if (code == "STARTING") throw; }
    }

    private void OnApplicationExit(object sender, EventArgs e) { if (backend != null && !backend.HasExited) Stop(); }

    protected override void Dispose(bool disposing)
    {
        if (disposing && !disposed)
        {
            disposed = true;
            Application.ApplicationExit -= OnApplicationExit;
            if (timer != null) timer.Dispose();
            if (tray != null) { tray.Visible = false; tray.ContextMenuStrip.Dispose(); tray.Dispose(); }
            if (backend != null) { backend.StandardInput.Dispose(); backend.Dispose(); }
        }
        base.Dispose(disposing);
    }
}
