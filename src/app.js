import express from "express"
import cors from "cors"
import { healthcheck } from "./controllers/healthcheck.controller.js"


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



// routes

app.use("/api/v1/healthcheck", healthcheck)
app.use




export {app};