import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"

import { User } from "../models/user.models.js"

import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = async (userId) => {
    const user = await User.findById(userId)


    const refreshToken = user.generateRefreshToken()
    const accessToken = user.generateAccessToken()

    user.refreshToken = refreshToken
    await user.save({ validateBeforeSave: false })
    return { accessToken, refreshToken }
}


const registerUser = asyncHandler(async (req, res) => {
    const { fullname, email, username, password } = req.body


    // validation
    if (
        [fullname, username, email, password].some((field) =>
            field?.trim() === "")

    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username")
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path
    const coverLocalPath = req.files?.coverImage?.[0]?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }


    // const avatar = await uploadOnCloudinary(avatarLocalPath)
    // let coverImage = ""
    // if (coverLocalPath) {
    //     coverImage = await uploadOnCloudinary(coverImage)
    // }

    let avatar;
    try {
        avatar = await uploadOnCloudinary(avatarLocalPath)
        console.log("Uploaded avatar", avatar);

    } catch (error) {
        console.log("error uploading avatar", error);
        throw new ApiError(500, "fail to upload Avatar")
    }



    let coverImage;

    try {
        coverImage = await uploadOnCloudinary(coverLocalPath)
        console.log("Uploaded avatar", coverImage);

    } catch (error) {
        console.log("error uploading coverImage", error);
        throw new ApiError(500, "fail to upload coferImage")
    }


    try {
        const user = await User.create({
            fullname,
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
            email,
            password,
            username: username.tolowercase()
        })

        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
        )

        if (!createdUser) {
            throw new ApiError(500, "Something went wrong while registering the user")
        }
        return res
            .status(201)
            .json(new ApiResponse(200, createdUser, "User registered successfully"))
    } catch (error) {
        console.log("user creation failed");

        if (coverImage) {
            await deleteFromCloudinary(avatar.public._id)
        }

        throw new ApiError(500, "Something went wrong while registering the user and images were deleted")

    }
})

const loginUser = asyncHandler(async (req, res) => {

    const { email, username, password } = req.body

    // validation 
    if (!email) {
        throw new ApiError(400, "email is required")
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(404, "user not found")
    }


    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "invalid credentials")
    }


    const { accessToken, refreshToken } = await
        generateAccessAndRefreshToken(user._id)

    const loggedInUser = await user.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",

    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new Response(
            200,
            { user: loggedInUser, accessToken, refreshToken },
            "User logged In successfully"
        ))
})


const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined,

            }
        },
        { new: true }
    )

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)

        .json(new ApiResponse(200, {}, "user logged out successfully"))


})


const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "refresh token is required")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET

        )

        const user = await User.findById(decodedToken?._id)

        if (!user) {
            throw new ApiError(401, "user not found")
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "invalid refresh token")
        }

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
        }

        const { accessToken, refreshToken: newRefreshToken } =
            await generateAccessAndRefreshToken(user._id)



        return res

            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(new Response(
                200,
                { user: loggedInUser, accessToken, refreshToken },
                "User logged In successfully"
            ))
    }
    catch (error) {
        throw new ApiError(500, "something went wrong while refreshing new token")
    }
})


const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordValid = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordValid) {
        throw new ApiError(401, " old password is incorrect")
    }

    user.password = newPassword

    await user.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed succesfully"))
})


const getCurrentUser = asyncHandler(async (req, res) => {

    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "current user details"))
})


const updateAccountDetails = asyncHandler(async (req, res) => {

    const { fullname, email } = req.body

    if (!fullname || !email) {
        throw new ApiError(400, "fullname and email are required")
    }


    User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email: email
            }
        },

        { new: true }

    ).select("-password -refreshToken ")

    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "Account details updated successfully"))

})


const updateUserAvatar = asyncHandler(async (req, res) => {

    const avatarLocalPath = req.files?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (avatar.url) {
        throw new ApiError(500, "Something  went wrong while on server")
    }


    const user = await User.findByIdAndUpdate(

        req.user._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password -refreshToken")

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar updated successfully"))
})


const updateUserCoverImage = asyncHandler(async (req, res) => { 
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath) {
        throw new ApiError(400, "file is required")
        
    }

  const coverImage  =  await uploadOnCloudinary(coverImageLocalPath)

  if (!coverImage.url) {
     throw new ApiError(500, "something went wrong while uploading the cover image")
  }

  const user = await   User.findByIdAndUpdate(
    req.user?._id, 


    {
        $set: {
            coverImage: coverImage.url
        }
    }, 
    {new:true}
  ).select("-password -refreshToken")

   return res
        .status(200)
        .json(new ApiResponse(200, user, "CoverImage updated successfully"))

})

export {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser, 
    changeCurrentPassword, 
    getCurrentUser, 
    updateAccountDetails, 
    updateUserAvatar, 
    updateUserCoverImage

}