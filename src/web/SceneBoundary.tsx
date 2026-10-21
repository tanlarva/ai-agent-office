import { Component, type ReactNode } from 'react';
import { Box } from 'lucide-react';

export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="scene-fallback"><Box size={32} /><p>3D không khả dụng trên thiết bị này.</p><span>Bảng agent vẫn hiển thị trạng thái đầy đủ.</span></div> : this.props.children;
  }
}
