import { request } from "express";
import mongoose, { Schema } from "mongoose";


const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        fullName: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        avatar: {
            type: String,
            required: true
        },
        coverImage: {
            type: String
        },
        watchHistory: [
            {
                type: Schema.type.objectId,
                ref: "Video"
            }
        ],
        password: {
            type: String,
            required: [true, "password is required "]
        },
        refreshToken: {
            type: String
        }

    }, 
    {timestamps:  true}

)


export const User = mongoose.model("User", userSchema)