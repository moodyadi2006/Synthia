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
    const { userEmail, conversationData } = await request.json();

    const user = await UserModel.findOne({ email: userEmail });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "User not found",
        },
        { status: 404 }
      );
    }

    const folder = user.folders.find(
      (f) =>
        f?.folderName?.toString() === conversationData.folderName?.toString()
    );

    if (!folder) {
      return NextResponse.json(
        {
          success: false,
          message: "Folder not found",
        },
        { status: 404 }
      );
    }

    folder.conversations.push({
      id: conversationData.id,
      name: conversationData.name,
      messages: conversationData.messages || [],
      createdAt: conversationData.createdAt || new Date().toISOString(),
      updatedAt: conversationData.updatedAt || new Date().toISOString(),
    });

    await user.save();

    return NextResponse.json(
      {
        success: true,
        message: "Conversation created successfully",
        conversation: folder.conversations[folder.conversations.length - 1],
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
