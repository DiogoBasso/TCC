import express from "express"
import { ParamType, validatorMiddleware } from "../middleware/validatorMiddleware"
import { userController } from "../appContainer"
import { createUserSchema, updateUserSchema, userIdParamSchema } from "../validator/userValidator"

const router = express.Router()

export function userRoute() {
  router.post(
    "/users",
    validatorMiddleware(ParamType.BODY, createUserSchema),
    async (req, res) => await userController.createUser(req, res)
  )

  router.get(
    "/users/:userId",
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    async (req, res) => await userController.getUserById(req, res)
  )

  router.get(
    "/users/active",
    async (req, res) => await userController.getAllActiveUsers(req, res)
  )

  router.put(
    "/users/:userId",
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    validatorMiddleware(ParamType.BODY, updateUserSchema),
    async (req, res) => await userController.updateUser(req, res)
  )

  router.delete(
    "/users/:userId",
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    async (req, res) => await userController.deleteUser(req, res)
  )

  return router
}
