
export const onboardingService = {
  markOnboardingComplete: () => {
    localStorage.setItem("butcem_onboarding_completed_v7", "true");
  },
  isOnboardingComplete: () => {
    return localStorage.getItem("butcem_onboarding_completed_v7") === "true";
  }
};
