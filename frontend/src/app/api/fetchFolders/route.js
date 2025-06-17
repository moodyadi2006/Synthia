import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/options";
import { getServerSession } from "next-auth";

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
