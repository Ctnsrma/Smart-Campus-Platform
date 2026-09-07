import jwt from "jsonwebtoken";

export interface AccessTokenPayload {
    sub: string;
    email: string;
    role: string;
}

export function signAccessToken(payload: AccessTokenPayload) : string {
    const secret = process.env.JWT_ACCESS_SECRET;
    if(!secret){
        throw new Error("JWT_ACCESS_SECRET is not set");
    }
    return jwt.sign(payload,secret,{expiresIn: "15m"});
}

export function verifyAccessToken(token: string) : AccessTokenPayload {
    const secret = process.env.JWT_ACCESS_SECRET;
    if(!secret){
        throw new Error("JWT_ACCESS_SECRET is not set");
    }
    return jwt.verify(token,secret) as AccessTokenPayload;
}