import express from "express"
import { authMiddleware } from "./middleware/authMiddleware"
import { corsMiddleware } from "./middleware/corsMiddleware"


const app = express()

app.use(express.json())

app.use(corsMiddleware)
app.use(authMiddleware)


export default app