import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User";
import { NextResponse } from "next/server";

export async function POST(request) {
  await dbConnect();

  try {
    const { userEmail, conversationData } = await request.json();
    console.log(
      "Creating conversation for:",
      userEmail,
      "with conversation :",
      conversationData
    );

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
      (f) => f?.folderName?.toString() === conversationData.folderName?.toString()
    );
    // Find folder by subdocument _id
    console.log(folder);
    if (!folder) {
      return NextResponse.json(
        {
          success: false,
          message: "Folder not found",
        },
        { status: 404 }
      );
    }

    // Push conversation into the folder's conversations array
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
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
