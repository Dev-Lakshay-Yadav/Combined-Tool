import "express-session";
import { ProfileAttributes } from "../models/Profile_Types";

declare module "express-session" {
  interface SessionData {
    impersonatedBy?: Partial<ProfileAttributes>;
  }
}
