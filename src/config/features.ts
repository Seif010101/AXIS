// Feature flags. Live classes are deferred: the legacy public meet.jit.si embed is
// cut off after 5 minutes, so it is not ported. Provider decision is pending.
export const features = {
  liveClasses: false,
  microsoftSignIn: false,
} as const;
