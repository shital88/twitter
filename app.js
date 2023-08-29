const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let database;
const app = express();
app.use(express.json());

const initializeDBAndServer = async () => {
  try {
    database = await open({
      filename: path.join(__dirname, "twitterClone.db"),
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running on http://localhost:3000/");
    });
  } catch (error) {
    console.log(`Database error is ${error.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const checkUser = `select * from user where username='${username}';`;
  const dbUser = await database.get(checkUser);
  console.log(dbUser);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashPassword = await bcrypt.hash(password, 10);
      const requestQuery = `INSERT INTO 
                                user(name, username, password, gender) 
                            VALUES(
                                '${name}', 
                                '${username}', 
                                '${hashPassword}', 
                                '${gender}'
                            );
                    `;
      await database.run(requestQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUser = `select * from user where username='${username}';`;
  const dbUserExits = await database.get(checkUser);
  if (dbUserExits !== undefined) {
    const checkPassword = await bcrypt.compare(password, dbUserExits.password);
    if (checkPassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secret_key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

// //authentic jwt token

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "secret_key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.get(
  "/user/tweets/feed/",
  authenticationToken,
  async (request, response) => {
    let { username } = request;
    const getUserIdQuery = `select user_id from user where username='${username}';`;
    const getUserId = await database.get(getUserIdQuery);
    const getFollowerIdsQuery = `select following_user_id from follower where follower_user_id=${getUserId.user_id};`;
    const getFollowerIds = await database.all(getFollowerIdsQuery);
    const getFollowerIdsSimple = getFollowerIds.map((eachUser) => {
      return eachUser.following_user_id;
    });
    const getTweetQuery = `select user.username, tweet.tweet, tweet.date_time as dateTime from user inner join tweet
    on user.user_id=tweet.user_id where user.user_id in (${getFollowerIdsSimple})
    order by tweet.date_time desc limit 4;`;
    const responseResult = await database.all(getTweetQuery);
    response.send(responseResult);
  }
);

app.get("/user/following/", authenticationToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}'`;
  const getUserId = await database.get(getUserIdQuery);
  const getFollowerIdsQuery = `select following_user_id from follower where follower_user_id=${getUserId.user_id};`;
  const getFollowerIdsArray = await database.all(getFollowerIdsQuery);
  const getFollowerIds = getFollowerIdsArray.map((eachUser) => {
    return eachUser.following_user_id;
  });
  const getFollowerResultQuery = `select name from user where user_id in(${getFollowerIds});`;
  const responseResult = await database.all(getFollowerResultQuery);
  response.send(responseResult);
});

app.get("/user/followers/", authenticationToken, async (request, response) => {
  let { username, userId } = request;
  const getFollowersQuery = `SELECT DISTINCT
                                    name 
                                FROM 
                                    follower INNER JOIN user ON user.user_id = follower.follower_user_id
                                WHERE 
                                    following_user_id = '${userId}';`;
  const followerArray = await database.all(getFollowersQuery);
  response.send(followerArray);
});

// const api6Output = (tweetData, likesCount, replyCount) => {
//   return {
//     tweet: tweetData.tweet,
//     likes: likesCount.likes,
//     replies: replyCount.replies,
//     dateTime: tweetData.date_time,
//   };
// };

// app.get("/tweets/:tweetId/", authenticationToken, async (request, response) => {
//   const { tweetId } = request.params;
//   let { username } = request;
//   const getUserIdQuery = `select user_id from user where username='${username}';`;
//   const getUserId = await database.get(getUserIdQuery);
//   const getFollowingIdsQuery = `select following_user_id from follower where follower_user_id=${getUserId.user_id};`;
//   const getFollowingIdsArray = await database.all(getFollowingIdsQuery);
//   const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
//     return eachFollower.following_user_id;
//   });
//   const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds});`;
//   const getTweetIdsArray = await database.all(getTweetIdsQuery);
//    const followingTweetIds = getTweetIdsArray.map((eachId) => {
//     return eachId.tweet_id;
//   });
//   if (followingTweetIds.includes(parseInt(tweetId))) {
//     const likes_count_query = `select count(user_id) as likes from like where tweet_id=${tweetId};`;
//     const likes_count=await database.get(likes_count_query);

//     count reply_count_query=`select count(user_id) as replies from reply where tweet_id=${tweetId};`;
//     count reply_count= await database.get(reply_count_query);

//     const tweet_tweetDateQuery=`select tweet, date_time from tweet where tweet_id=${tweetId};`;
//     const tweet_tweetDate=await database.get(tweet_tweetDateQuery);

//     response.send(api6Output(tweet_tweetDate, likes_count, reply_count));
//   }else{
//       response.status(401);
//       response.send("Invalid Request");

//   }
// });

app.get("/tweets/:tweetId", authenticationToken, async (request, response) => {
  const { tweetId } = request;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  const tweetsQuery = `SELECT * FROM tweet WHERE tweet_id=${tweetId};`;
  const tweetsResult = await database.get(tweetsQuery);
  const userFollowersQuery = `
        SELECT
            *
        FROM follower INNER JOIN user ON user.user_id=follower.following_user_id
        WHERE
            follower.follower_user_id=${user_id};
        `;
  const userFollowers = await database.all(userFollowersQuery);
  if (
    userFollowers.some(
      (item) => item.following_user_id === tweetsResult.user_id
    )
  ) {
    console.log(tweetsResult);
    const getTweetDetailsQuery = `
      SELECT
        tweet,
        COUNT(DISTINCT(like.like_id)) AS likes,
        COUNT(DISTINCT(reply.reply_id)) AS replies,
        tweet.date_item AS dateTime
      FROM
        tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id INNER JOIN reply ON reply.tweet_id= tweet.tweet_id
      WHERE
        tweet.tweet_id=${tweetId} AND tweet.user_id=${userFollowers[0].user_id};
      `;
    const tweetDetails = await database.get(getTweetDetailsQuery);
    response.send(tweetDetails);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

app.get(
  "/tweets/:tweetId/likes",
  authenticationToken,
  async (request, response) => {
    const { tweetId } = request;
    const { payload } = request;
    const { user_id, name, username, gender } = payload;
    const getLikedUsersQuery = `
            SELECT
                *
            FROM
                follower INNER JOIN tweet ON tweet.user_id = follower.following_user_id INNER JOIN like ON like.tweet_id=tweet.tweet_id
                INNER JOIN user ON user.user_id = like.user_id
            WHERE
                tweet.tweet_id= ${tweetId} AND follower.follower_user_id = ${user_id};`;
    const likedUsers = await database.all(getLikedUsersQuery);
    if (likedUsers.length !== 0) {
      let likes = [];
      const getNamesArray = (likedUsers) => {
        for (let item of likedUsers) {
          likes.push(item.username);
        }
      };
      getNamesArray(likedUsers);
      response.send({ likes });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.get(
  "/tweets/:tweetId/replies",
  authenticationToken,
  async (request, response) => {
    const { tweetId } = request;
    const { payload } = request;
    const { user_id, name, username, gender } = payload;
    const getRepliedUserQuery = `
                    SELECT
                        *
                    FROM 
                        follower INNER JOIN tweet ON tweet.user_id= follower.following_user_id INNER JOIN reply ON reply.tweet_id=tweet.tweet_id
                        INNER JOIN user ON user.user_id=reply.user_id
                    WHERE
                        tweet.tweet_id=${tweetId}AND follower,follower_user_id=${user_id};
                `;
    const repliedUsers = await database.all(getRepliedUserQuery);
    if (repliedUsers !== 0) {
      let replies = [];
      const getNamesArray = (repliedUsers) => {
        for (let item of repliedUsers) {
          let object = {
            name: item.name,
            reply: item.reply,
          };
          replies.push(object);
        }
      };
      getNamesArray(repliedUsers);
      response.send({ replies });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
app.get("/user/:tweets", authenticationToken, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  const getTweetsDetailsQuery = `
            SELECT 
                tweet.tweet AS tweet,
                COUNT(DISTINCT(like.like_id)) AS likes,
                COUNT(DISTINCT(reply.reply_id)) AS replies,
                tweet.date_time AS dateTime
            FROM
                user INNER JOIN tweet ON user.user_id = tweet.user_id INNER JOIN like ON like.tweet_id=tweet.tweet_id
            WHERE 
                user.user_id=${user_id}
            GROUP BY
                tweet.tweet_id;
            `;
  const tweetDetails = await database.all(getTweetsDetailsQuery);
  response.send(tweetDetails);
});

app.post("/user/tweets", authenticationToken, async (request, response) => {
  const { tweet } = request;
  const { tweetId } = request;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  const postTweetQuery = `
            INSERT INTO
                tweet (tweet,user_id)
            VALUES(
                '${tweet}',
                ${user_id}
                );
                `;
  await db.run(postTweetQuery);
  response.send("Created a Tweet");
});

app.delete(
  "/tweets/:tweetId",
  authenticationToken,
  async (request, response) => {
    const { tweetId } = request;
    const { payload } = request;
    const { user_id, name, username, gender } = payload;
    const selectUserQuery = `SELECT * FROM tweet WHERE tweet.user_id=${user_id} AND tweet.tweet_id=${tweet_id};`;
    const tweetUser = await db.all(selectUserQuery);
    if (tweetUser.length !== 0) {
      const deleteTweetQuery = `DELETE FROM tweet WHERE tweet.user_id=${user_id} AND tweet.tweet_id=${tweetId};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
