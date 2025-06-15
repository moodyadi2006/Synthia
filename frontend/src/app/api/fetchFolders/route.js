import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User";
import { NextResponse } from "next/server";

export async function POST(request) {
  await dbConnect();

  try {
    const { email } = await request.json();

    const existingUser = await UserModel.findOne({ email }).select("folders");

    if (!existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "User not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Folders fetched successfully",
        folders: existingUser.folders || [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching folders:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
