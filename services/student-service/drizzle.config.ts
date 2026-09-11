import "dotenv/config"; 
console.log(process.env.DATABASE_URL)
import {defineConfig} from "drizzle-kit";

if(!process.env.DATABASE_URL){
    throw new Error("DATABASE_URL is not set - check your .env file.");
}

export default defineConfig({
    dialect: "postgresql",
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dbCredentials: {
        url: process.env.DATABASE_URL,
    },
    schemaFilter: ["student_service"],
})
