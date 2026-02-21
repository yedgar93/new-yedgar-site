import { NextResponse } from "next/server";
import axios from "axios";

const CLIENT_ID = "8ygbCiQb18i4IGztE2PAQjwqtsxfkQuZ";
const CLIENT_SECRET = "w3y5QE0GERhxpno2GxQsiOJDlFp4rDN";
const BASE_URL = "https://api.soundcloud.com";

async function getAccessToken() {
  try {
    const response = await axios.post(
      "https://api.soundcloud.com/oauth2/token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "client_credentials",
      },
    );
    return response.data.access_token;
  } catch (error) {
    const err = error as any;
    console.error(
      "Error fetching access token:",
      err.response?.data || err.message,
    );
    throw new Error("Failed to fetch access token");
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trackUrl = searchParams.get("trackUrl");

  if (!trackUrl) {
    return NextResponse.json(
      { error: "Missing trackUrl parameter" },
      { status: 400 },
    );
  }

  try {
    const accessToken = await getAccessToken();
    const response = await axios.get(`${BASE_URL}/resolve`, {
      params: {
        url: trackUrl,
        client_id: CLIENT_ID,
      },
      headers: {
        Authorization: `OAuth ${accessToken}`,
      },
    });
    return NextResponse.json(response.data);
  } catch (error) {
    const err = error as any;
    console.error("Error in SoundCloud proxy:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });
    return NextResponse.json(
      {
        error: "Failed to fetch track details",
        details: err.response?.data || err.message,
      },
      { status: err.response?.status || 500 },
    );
  }
}
