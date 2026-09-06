import rateLimit from "express-rate-limit";

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: true,
    message: {error: "Too many attempts, please try again later."},
});