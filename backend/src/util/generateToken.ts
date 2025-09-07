import { UserRole } from "@prisma/client"
import jwt from "jsonwebtoken"

export function generateAccessToken(userRole: UserRole, userId: number, isTeacher: boolean): string {
    return jwt.sign({
        userRole: userRole,
        userId: userId,
        isTeacher: isTeacher
    }, String(process.env.JWT_SECRET), { expiresIn: process.env.JWT_ACCESS_EXPIRATION })
}

export function generateRefreshToken(userId: number): string {
    return jwt.sign({
        jit: userId,
    }, String(process.env.JWT_REFRESH_SECRET), { expiresIn: process.env.JWT_REFRESH_EXPIRATION })
}