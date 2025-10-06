import express from "express"
import { ParamType, validatorMiddleware } from "../middleware/validatorMiddleware"
import { loginSchema, refreshTokenSchema, selectRoleSchema } from "../validator/userValidator"
import { userController } from "../appContainer"
import { authMiddleware } from "../middleware/authMiddleware"

const router = express.Router()

export function authRoute() {
    router.post(
        "/login", 
        validatorMiddleware(ParamType.BODY, loginSchema), 
        async (req, res) => await userController.login(req, res))

    router.post(
        "/refresh-token", 
        validatorMiddleware(ParamType.BODY, refreshTokenSchema), 
        async (req, res) => await userController.refreshToken(req, res))
     router.post(
        "/select-role",
        validatorMiddleware(ParamType.BODY, selectRoleSchema),
        async (req, res) => await userController.selectRole(req, res)
    )

    return router
}