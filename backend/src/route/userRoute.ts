import express  from "express"
import { ParamType, validatorMiddleware } from "../middleware/validatorMiddleware"
import { userController } from "../appContainer"
import { createUserSchema } from "../validator/userValidator"


const router = express.Router()

export function userRoute(){
    router.post(
        "/users",
        validatorMiddleware(ParamType.BODY, createUserSchema),
        (req, res) => userController.createUser(req, res)
    )

    return router
}