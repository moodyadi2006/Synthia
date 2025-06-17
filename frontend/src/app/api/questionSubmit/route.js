import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/options";
import axios from "axios";
import FormData from "form-data";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const incomingForm = await req.formData();

    const formData = new FormData();
    for (const [key, value] of incomingForm.entries()) {
      if (typeof value === "string") {
        formData.append(key, value);
      } else {
        const buffer = Buffer.from(await value.arrayBuffer());
        formData.append(key, buffer, value.name);
      }
    }

    formData.append("user_id", session.user._id);
    formData.append("provider", session.provider);

    const fastApiRes = await axios.post(
      "http://127.0.0.1:8000/query",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${session.accessToken}`,
          "X-User-Provider": session.provider,
        },
      }
    );

    return NextResponse.json(fastApiRes.data);
  } catch (error) {
    return NextResponse.json(
      { error: "Something went wrong while processing your question." },
      { status: 500 }
    );
  }
}
