import "dotenv/config";
import express, { Request, Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

export function createApp() {
  const app = express();
  
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "api-gateway",
      timestamp: new Date().toISOString(),
    });
  });

  
  app.use(
      createProxyMiddleware({
          target: process.env.STUDENT_SERVICE_URL,
          changeOrigin: true,
          pathFilter: "/students",
        }),
    );
    
    app.use(
    createProxyMiddleware({
      target: process.env.AUTH_SERVICE_URL,
      changeOrigin: true,
      pathFilter: "/auth",
    }),
  );
    app.use(
  createProxyMiddleware({
    target: process.env.COURSE_SERVICE_URL,
    changeOrigin: true,
    pathFilter: "/courses",
  }),
);

app.use(
  createProxyMiddleware({
    target: process.env.ATTENDANCE_SERVICE_URL,
    changeOrigin: true,
    pathFilter: "/attendance",
  }),
);

  return app;
}