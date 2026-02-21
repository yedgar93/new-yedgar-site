import axios from "axios";

const CLIENT_ID = "8ygbCiQb18i4IGztE2PAQjwqtsxfkQuZ";
const CLIENT_SECRET = "w3y5QE0GERhxpno2GxQsiOJDlFp4rDN";
const BASE_URL = "https://api.soundcloud.com";

// Function to get an access token
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

// Function to fetch track details
export async function fetchTrackDetails(trackUrl: string) {
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
    return response.data;
  } catch (error) {
    const err = error as any;
    console.error(
      "Error fetching track details:",
      err.response?.data || err.message,
    );
    throw new Error("Failed to fetch track details");
  }
}

// Function to fetch comments for a track
export async function fetchTrackComments(trackId: string) {
  try {
    const accessToken = await getAccessToken();
    const response = await axios.get(`${BASE_URL}/tracks/${trackId}/comments`, {
      params: {
        client_id: CLIENT_ID,
      },
      headers: {
        Authorization: `OAuth ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    const err = error as any;
    console.error(
      "Error fetching track comments:",
      err.response?.data || err.message,
    );
    throw new Error("Failed to fetch track comments");
  }
}
