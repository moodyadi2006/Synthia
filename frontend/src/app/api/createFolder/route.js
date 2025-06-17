import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User";
import { authOptions } from "../auth/[...nextauth]/options";
import { getServerSession } from "next-auth";

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();

  try {
    const { userEmail, folderName } = await request.json();

    const user = await UserModel.findOne({ email: userEmail });

    if (!user) {
      return Response.json(
        {
          success: false,
          message: "User not found",
        },
        { status: 404 }
      );
    }
    const newFolder = {
      folderName,
      conversations: [],
    };

    user.folders.push(newFolder);
    await user.save();

    return Response.json(
      {
        success: true,
        message: "Folder created successfully",
        folder: newFolder,
      },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
