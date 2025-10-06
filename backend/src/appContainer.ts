import { UserRepository } from "./repository/userRepository"
import { UserService } from "./service/userService"
import { UserController } from "./controller/userController"



export const userRepository = new UserRepository()
export const userService = new UserService(userRepository)
export const userController = new UserController(userService)



