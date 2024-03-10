const express=require("express")
const {open}=require("sqlite")
const path=require("path")
const rareLimit=require("express-rate-limit")
const sqlite3=require("sqlite3")
const jwt=require("jsonwebtoken")
const bcrypt=require("bcrypt")
const { request } = require("http")
const app=express()
const date = require('date-and-time');
const jsonMiddleware = express.json();
app.use(jsonMiddleware);
app.use(rareLimit({
  windowMs:15 *60*1000,
  max:100
}))
const dbPath=path.join(__dirname,"users.db")


let db = null;
const d=new Date()
let dd=date.format(d, 'YYYY/MM/DD HH:mm:ss'); 
 
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3001, () => {
      console.log("Server Running at http://localhost:3001/",dd);
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};



const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};


app.post("/users/", async (request, response) => {
  const { username,  password } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE user_name = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (user_name, password) 
      VALUES 
        (
          '${username}', 
          '${hashedPassword}'
         
        )`;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;
    response.send(`Created new user with ${newUserId}`);
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE user_name = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

app.post("/transations",authenticateToken,async(request,response)=>{
  // const {username}=request
  const {username,typeoftran,amount}=request.body
  const dateTime=new Date().toISOString();
  const addtran=`insert into transations(username,typeoftran,amount,date_time) values(
    '${username}',
    '${typeoftran}',
    '${amount}',
    '${dateTime}'
  );`
  const res=await db.run(addtran)
  response.send("transation created")
})

 // get type transations

 app.get("/transations",authenticateToken,async(request,response)=>{
  const{username}=request
  const {startdate,enddate}=request.params
  const query1=`select # from transations where user_name='${username}'`
  if (query1 !== undefined){
    const re=`select * as total'${type}' from transations 
    where user_name='${username}' and date_time between '${startdate}' and '${enddate};'`
    const result=await db.all (re)
    response.send(result)
  }
  else{
    response.status(401)
    response.send("There no type of transations")
  }
})



app.get("/transation/:type",authenticateToken,async(request,response)=>{
  const{username}=request
  const {type}=request.params
  const query1=`select '${type}' from transations where user_name='${username}'`
  if (query1 !== undefined){
    const re=`select sum(amount) as total'${type}' from transations 
    where user_name='${username}' and typeoftran='${type};`
    const result=await db.get(re)
    response.send(result)
  }
  else{
    response.status(401)
    response.send("There no type of transations")
  }
})

//delete api endpoint

app.delete("/delete/:transId", authenticateToken,async (request, response) => {
  const {username}=request;
  const { transId } = request.params;
  const query1=`select * from transations where user_name='${username}' and id='${transId}'`
  if (query1!==undefined){
  const deleteq = `
    DELETE FROM
      transations
    WHERE
      id = ${transId};`;
  await db.run(deleteq);
  response.send("Deleted Successfully");}
  else{
    response.status(401)
    response.send("invalid transation ")
  }
});




initializeDBAndServer();
