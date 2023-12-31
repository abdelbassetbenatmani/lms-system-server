import { Response } from "express";
import asyncHandler from "express-async-handler";
import Order from "../models/Order";

// @desc    Add order functionality
export const addOrder = asyncHandler(async (data: any, res: Response) => {
  const order = await Order.create(data);
  res.status(201).json({
    success: true,
    order,
  });
});

// @desc   Get all orders
export const getOrders = async (res: Response) => {
  const order = await Order.find({}).populate({
    path: "courseId",
    select: "title price",
  
  }).populate({
    path: "userId",
    select: "name email",
  });
  res.status(200).json({
      success: true,
      result:order.length,
      order,
  });
}