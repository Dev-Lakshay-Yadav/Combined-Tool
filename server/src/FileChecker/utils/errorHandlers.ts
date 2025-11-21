import { Response } from "express";

// 200 - OK (Generic Success)
export const handleApiSuccess = (
  res: Response,
  data?: any,
  message: string = "Resource",
  userDefinedMessage?: string
) => {
  const finalMessage = `${message} fetched successfully`;

  return res.status(200).json({
    success: true,
    message: userDefinedMessage || finalMessage,
    data,
  });
};

// 201 - Resource Created Successfully
export const handleApiCreated = (
  res: Response,
  data: any,
  message: string = "Resource"
) => {
  const finalMessage = `${message} created successfully`;
  return res.status(201).json({
    success: true,
    message: finalMessage,
    data,
  });
};

// 200 or 204 - Resource Updated Successfully
export const handleApiUpdated = (
  res: Response,
  data: any = null,
  message: string = "Resource",
  code: number = 200 // optionally use 204 for "No Content"
) => {
  if (code === 204) {
    return res.status(204).send(); // No content
  }

  const finalMessage = `${message} updated successfully`;

  return res.status(code).json({
    success: true,
    message: finalMessage,
    data,
  });
};

// 400 - Bad Request
export const handleApiBadRequest = (
  res: Response,
  message: string = "Missing Required Fields or Invalid Request Type"
) => {
  return res.status(400).json({
    success: false,
    message,
  });
};

//   403 - Forbidden
export const handleForbidden = (
  res: Response,
  message: string = "Forbidden "
) => {
  return res.status(403).json({
    success: false,
    message,
  });
};

// 404 - Not Found
export const handleApiNotFound = (
  res: Response,
  message: string = "Resource"
) => {
  const finalMessage = `${message} not found`;

  return res.status(404).json({
    success: false,
    message: finalMessage,
  });
};

// 500 - Internal Server Error
export const handleApiError = (
    res: Response,
    error: unknown,
    context: string = "Server Error",
    userDefinedMessage?: string
  ) => {
    console.error(`Error in ${context}:`, error);
  
    return res.status(500).json({
      success: false,
      message: userDefinedMessage || "Internal Server Error",
    });
  };