
import { signInAnonymously } from "firebase/auth";
import { auth } from "../utils/firebase";

export const authService = {
  signInAsGuest: async () => {
    try {
      await signInAnonymously(auth);
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }
};
