import type { Request, Response, NextFunction } from "express";
import { createClient } from "./server.ts";

export const supabaseAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const supabase = createClient(req, res);
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    // Optional: Only block /api protected routes
    if (req.path.startsWith('/api/protected')) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  // Attach user to request for later use
  (req as any).user = user;
  next();
};
