import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User";
import { authOptions } from "../auth/[...nextauth]/options";
import { getServerSession } from "next-auth";

export async function POST(req) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { conversationId, note, email } = await req.json();

    if (!email || !conversationId || typeof note !== "string") {
      return NextResponse.json(
        { success: false, message: "Invalid request data" },
        { status: 400 }
      );
    }

    await dbConnect();

    const user = await UserModel.findOne({ email });
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    const conversation = user.folders
      .flatMap((folder) => folder.conversations)
      .find((conv) => conv._id.toString() === conversationId);

    if (!conversation) {
      return NextResponse.json(
        { success: false, message: "Conversation not found" },
        { status: 404 }
      );
    }

    if (!Array.isArray(conversation.notes)) {
      conversation.notes = [];
    }

    const newNote = {
      type: "text",
      content: note,
      timestamp: new Date(),
    };

    conversation.notes.push(newNote);
    conversation.updatedAt = new Date();

    await user.save();

    return NextResponse.json({ success: true, notes: conversation.notes });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
