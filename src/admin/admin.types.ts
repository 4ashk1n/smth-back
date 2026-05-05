export type AdminModerateUserResponse = {
  success: true;
  data: {
    id: string;
    username: string;
    firstname: string;
    lastname: string;
    avatar: string;
    role: "user" | "moderator" | "admin";
    email: string | null;
    provider: string | null;
    isBanned: boolean;
    bannedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
};
