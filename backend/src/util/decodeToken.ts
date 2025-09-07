import jwt from "jsonwebtoken"

export function decodeRefreshToken(token: string): { userId: number } {
    const decodedToken: any = jwt.decode(token)
    
    if (decodedToken.exp*1000 < new Date().getTime()){
        throw new Error("Expired refresh token")
    }

    return {
        userId: decodedToken.jit,
    }
}