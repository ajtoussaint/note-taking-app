const express = require('express');

const app = express();

app.use('/public', express.static(process.cwd() + '/public'));

app.route('/')
  .get(function (req,res) {
    res.sendFile(process.cwd() + '/views/index.html');
  });

app.listen(3000, () =>{
  console.log("App is listening on port 3000");
});
