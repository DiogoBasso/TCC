import express from "express"
import "dotenv/config"
import { authMiddleware } from "./middleware/authMiddleware"
import { corsMiddleware } from "./middleware/corsMiddleware"
import { userRoute } from "./route/userRoute"
import { authRoute } from "./route/authRoute"
import { publicRegistrationRoute } from "./route/userRegistrationRoute"

const app = express()

app.use(corsMiddleware)
app.use(express.json())
//app.use(express.urlencoded({ extended: true }))

//rotas publicas
app.use(publicRegistrationRoute())
app.use(authRoute())



app.use(authMiddleware)
//rotas protegidas
app.use(userRoute())

export default app