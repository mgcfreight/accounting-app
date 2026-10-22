import { UserRole } from "../enums";
import { User } from "../interfaces";

export const mockUsers: User[] = [
  {
    id: "U-1",
    name: "Jordan Lee",
    email: "jordan.lee@example.com",
    role: UserRole.Admin,
    lastLoginAt: "2026-10-19T12:58:00Z",
    twoFactor: true,
    active: true,
  },
  {
    id: "U-2",
    name: "Sam Patel",
    email: "sam.patel@example.com",
    role: UserRole.Accountant,
    lastLoginAt: "2026-10-19T13:21:00Z",
    twoFactor: true,
    active: true,
  },
  {
    id: "U-3",
    name: "Alex Chen",
    email: "alex.chen@example.com",
    role: UserRole.Viewer,
    lastLoginAt: "2026-10-14T16:05:00Z",
    twoFactor: false,
    active: true,
  },
];

// The signed-in user, until there is a real session.
export const mockCurrentUser = mockUsers[0];
