import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User";

export async function POST(request) {
  await dbConnect();

  try {
    const { userEmail, folderName } = await request.json();
    console.log(userEmail);

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
