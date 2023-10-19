import ejs from "ejs";
import { NextFunction, Request, Response } from "express";
import path from "path";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import sendEmail from "../utils/sendMail";
import User, { IUser } from "../models/User";
import ApiError from "../utils/ApiError";
import { createActivationToken } from "../utils/generateToken";
import { accesTokenOptions, refreshTokenOptions, sendToken } from "../utils/jwt";
import { redis } from "../config/redis";

interface IRegisterBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}

export const registerNewUser = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password } = req.body;

      const user: IRegisterBody = { name, email, password };

      const activationToken = createActivationToken(user);

      const { activateCode, token } = activationToken;
      const data = { user: { name: user.name, activateCode } };
      const html = await ejs.renderFile(
        path.join(__dirname, "../mails/activation-mail.ejs"),
        data
      );

      try {
        await sendEmail({
          email: user.email,
          subject: "Activate Your Account",
          template: "activation-mail.ejs",
          data,
        });
        res.status(201).json({
          succes: true,
          message: `Please check your email ${user.email} to activate your account`,
          token: token,
        });
      } catch (error: any) {
        return next(
          new ApiError(`There was a problem to send email ${error}`, 500)
        );
      }
    } catch (error: any) {
      return next(new ApiError(`There was a problem ${error}`, 500));
    }
  }
);

interface IActivateAccount {
  activate_token: string;
  activate_code: string;
}
export const activateAccount = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { activate_token, activate_code } = req.body as IActivateAccount;
      const newUser: { user: IUser; activateCode: string } = jwt.verify(
        activate_token,
        process.env.JWT_TOKEN as string
      ) as { user: IUser; activateCode: string };

      if (newUser.activateCode !== activate_code) {
        return next(new ApiError(`The activation code is invalid`, 400));
      }

      const { name, email, password } = newUser.user;

      const user = User.create({ name, email, password });

      res.status(200).json({
        succes: true,
        user,
      });
    } catch (error: any) {
      return next(new ApiError(error.message, 400));
    }
  }
);

interface ILogin {
  email: string;
  password: string;
}

export const login = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as ILogin;
      const user = await User.findOne({ email }).select("+password");

      if (!user || !(await user.comparePassword(password))) {
        return next(
          new ApiError("there was an error in email or password", 401)
        );
      }

      sendToken(user, 200, res);
    } catch (error: any) {
      return next(new ApiError(error.message, 400));
    }
  }
);

export const logout = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.cookie("accessToken", "", { maxAge: 1 });
      res.cookie("refreshToken", "", { maxAge: 1 });
      const userId = req.user?._id || "";
      console.log(req.user);

      redis.del(userId);
      res.status(200).json({ success: true, message: "Logout successfully" });
    } catch (error: any) {
      return next(new ApiError(error.message, 400));
    }
  }
);

export const updateAccessToken = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refresh_token = req.cookies.refreshToken as string;

      const decoded = jwt.verify(
        refresh_token,
        process.env.REFRESH_TOKEN as string
      ) as JwtPayload;

      if (!decoded) {
        return next(new ApiError("token invalid", 401));
      }
      const session = await redis.get(decoded.id as string);
      if (!session) {
        return next(new ApiError("token invalid", 401));
      }
      const user = JSON.parse(session);

      const accessToken = jwt.sign(
        { id: user._id },
        process.env.ACCESS_TOKEN as string,
        {
          expiresIn:"5m",
        }
      );
      const refreshToken = jwt.sign(
        { id: user._id },
        process.env.REFRESH_TOKEN as string,
        {
          expiresIn:"3d",
        }
      );
      
      req.user = user;
      res.cookie("accessToken", accessToken, accesTokenOptions);
      res.cookie("refreshToken", refreshToken, refreshTokenOptions);

      res.status(200).json({
        success: true,
        accessToken,
      });
    } catch (error: any) {
      return next(new ApiError(error.message, 400));
    }
  }
);



interface ISocialAuth {
  name:string,
  email:string,
  avatar:string
}

export const socialAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {name,email,avatar} = req.body as ISocialAuth ;
    const user = await User.findOne({email})
    if(!user){
      const newUser = await User.create({name,email,avatar})
      sendToken(newUser, 200, res);
    }else{
      sendToken(user, 200, res);

    }
  } catch (error: any) {
    return next(new ApiError(error.message, 400));
  }
})