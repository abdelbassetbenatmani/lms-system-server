import ejs from "ejs";
import { NextFunction, Request, Response } from "express";
import path from "path";
import jwt, { Secret } from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import sendEmail from "../utils/sendMail";
import User, { IUser } from "../models/User";
import ApiError from "../utils/ApiError";
import { createActivationToken } from "../utils/generateToken";
require("dotenv").config();

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
      const {activate_token,activate_code} = req.body as IActivateAccount;
      const newUser:{user:IUser,activateCode:string} = jwt.verify(activate_token,process.env.JWT_TOKEN as string) as {user:IUser,activateCode:string};

      if(newUser.activateCode !== activate_code){
        return next(new ApiError(`The activation code is invalid`, 400));
      }

      const {name,email,password} = newUser.user;

      const user = User.create({name,email,password});

      res.status(200).json({
        succes:true,
        data: user
      })

    } catch (error:any) {
      return next(new ApiError(error.message, 400));
    }
  }
);
