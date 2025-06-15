import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User";

export async function POST(req) {
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

    // Find the conversation
    const conversation = user.folders
      .flatMap((folder) => folder.conversations)
      .find((conv) => conv._id.toString() === conversationId);

    if (!conversation) {
      return NextResponse.json(
        { success: false, message: "Conversation not found" },
        { status: 404 }
      );
    }

    // Ensure notes array is initialized
    if (!Array.isArray(conversation.notes)) {
      conversation.notes = [];
    }

    // Create a new note object
    const newNote = {
      type: "text",
      content: note,
      timestamp: new Date(),
    };

    // Add the note to the conversation
    conversation.notes.push(newNote);
    conversation.updatedAt = new Date(); // optional

    await user.save();

    return NextResponse.json({ success: true, notes: conversation.notes });
  } catch (error) {
    console.error("Error saving note:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
