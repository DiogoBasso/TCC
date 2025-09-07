import jwt from "jsonwebtoken"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"

export function authMiddleware(req: any, res: any, next: any) {
    let token = req.header("Authorization")
    if (!token) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "'Authorization' header is required", null)
    }
    if (token.startsWith("Bearer")) {
        token = token.replace("Bearer " , "")
    }

    try {
        jwt.verify(token, String(process.env.JWT_SECRET))
        next()
    } catch (error: any) {
        console.log(error.message)
        return HttpResponse.unauthorized(res)
    }
}