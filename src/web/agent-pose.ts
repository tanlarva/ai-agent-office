export interface AgentMotion {
  time: number;
  walking: boolean;
  working: boolean;
  waiting: boolean;
  carrying: boolean;
  atDelivery: boolean;
  disabled: boolean;
  asking?: boolean;
  celebrating?: boolean;
  thinking?: boolean;
  sad?: boolean;
}

export const restingMotion = (): AgentMotion => ({ time: 0, walking: false, working: false, waiting: false, carrying: false, atDelivery: false, disabled: true });

// Rotations on the VRM normalized humanoid rig, relative to its T-pose.
export function sampleHumanoidPose(motion: AgentMotion) {
  const { time: t, disabled } = motion;
  const walking = !disabled && motion.walking, working = !disabled && motion.working;
  const asking = !disabled && motion.asking, celebrating = !disabled && motion.celebrating;
  const stride = walking ? Math.sin(t * 12) : 0;
  const typing = working ? Math.sin(t * (motion.thinking ? 5 : 9)) : 0;
  return {
    leftLeg: stride * 0.42,
    rightLeg: -stride * 0.42,
    leftKnee: Math.max(0, -stride) * 0.36,
    rightKnee: Math.max(0, stride) * 0.36,
    leftArmX: working ? -0.6 + typing * 0.045 : -stride * 0.3,
    rightArmX: asking ? -0.3 : !disabled && motion.carrying ? -0.6 : working ? -0.6 - typing * 0.045 : stride * 0.3,
    leftArmZ: celebrating ? -1.1 : working ? 1.05 : 1.38,
    rightArmZ: asking ? 1.15 + Math.sin(t * 6) * 0.15 : celebrating ? 1.1 : !disabled && motion.carrying ? -1 : working ? -1.05 : -1.38,
    leftElbow: working ? -0.75 + typing * 0.06 : -0.12,
    rightElbow: !disabled && motion.carrying ? -1.1 : working ? -0.75 - typing * 0.06 : -0.12,
    headX: !disabled && motion.sad ? 0.3 : working ? 0.12 : 0,
    headY: !disabled && motion.waiting ? Math.sin(t * 0.8) * 0.25 : working ? Math.sin(t * 0.65) * 0.06 : 0,
    blink: disabled ? 0 : Math.sin(t * 1.3) > 0.995 ? 1 : 0,
  };
}
