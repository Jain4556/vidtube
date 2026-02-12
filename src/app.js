import express from "express"
import cors from "cors"
import { healthcheck } from "./controllers/healthcheck.controller.js"
import cookieParser from "cookie-parser"

import userRouter from "./routes/user.routes.js"
import { errorHandler } from "./middlewares/error.middleware.js"

const app = express()


app.use(
    cors({
        origin: process.env.CORS_ORIGIN, 
        credentials: true
    })
)

// middleware
app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())


// routes

app.use("/api/v1/healthcheck", healthcheck)
app.use("/api/v1/users", userRouter)


// app.use(errorHandler)

export {app};

