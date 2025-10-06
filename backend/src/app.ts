import express from "express"
import { authMiddleware } from "./middleware/authMiddleware"
import { corsMiddleware } from "./middleware/corsMiddleware"
import { userRoute } from "./route/userRoute"
import { authRoute } from "./route/authRoute"

const app = express()

app.use(corsMiddleware)
app.use(express.json())
//app.use(express.urlencoded({ extended: true }))

//rotas publicas
app.use(userRoute())
app.use(authRoute())



app.use(authMiddleware)
//rotas protegidas

export default app