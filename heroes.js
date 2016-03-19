function slugify(text)
{
  return text.toString().toLowerCase()
  .replace(/\s+/g, '-')           // Replace spaces with -
  .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
  .replace(/\-\-+/g, '-')         // Replace multiple - with single -
  .replace(/^-+/, '')             // Trim - from start of text
  .replace(/-+$/, '');            // Trim - from end of text
}

angular.module('heroes', [])
.service("Heroes", function($http) {
  this.all = function() {
    return $http.get("http://hotslogs.s3-website-us-east-1.amazonaws.com/manifest.json").then(function(response) {
      return response.data;
    });
  }
  this.history_for = function(hero) {
    return $http.get("http://hots-pull.herokuapp.com/history/" + hero).then(function(response) {
      return response.data;
    })
  }
})
.controller("HeroList", function($scope, Heroes, $q) {
  $scope.loading = true;
  Heroes.all().then(function(heroes) {
    $scope.heroes = _.map(heroes,function(hero) {
      hero.score = (hero.win_rate * hero.popularity) / 100
      return hero;
    });


    var promises = [];

    $scope.heroes.forEach(function(hero) {
      promises.push(Heroes.history_for(hero.name).then(function(data) {
        return data.map(function(datum) {
          return {
            name: datum.name,
            date: datum.date,
            score: (datum.win_rate * datum.popularity) / 100,
            win_rate: datum.win_rate,
            popularity: datum.popularity,
            games_played: datum.games_played
          }
        });
      }));
    });

    $q.all(promises).then(function(a) {
      $scope.loading = false;

      var margin = {top: 20, right: 40, bottom: 40, left: 50};
      var width = 920 - margin.left - margin.right;
      var height = 400 - margin.top - margin.bottom;

      var x = d3.time.scale().range([0, width]);
      var y = d3.scale.linear().range([height, 0]);
      x.ticks(d3.time.day, 1);

      var formatDate = d3.time.format("%Y-%m-%d %H:%M:%S +0000");

      var yMin = _.min(_.map(a, function(hero) {
        return _.min(hero, function(datum) {
          return datum.score;
        }).score;
      }));
      var yMax = _.max(_.map(a, function(hero) {
        return _.max(hero, function(datum) {
          return datum.score;
        }).score;
      }));
      
      var xMin = formatDate.parse(_.min(a[0], function(datum) {
        return formatDate.parse(datum.date);
      }).date);
      var xMax =formatDate.parse(_.max(a[0], function(datum) {
        return formatDate.parse(datum.date);
      }).date);

      x.domain([xMin, xMax]);
      y.domain([yMin, yMax]);

      var xAxis = d3.svg.axis().scale(x).orient("bottom");
      var yAxis = d3.svg.axis().scale(y).orient("left");
      xAxis.ticks(_.min([(a[0].length), 10]));
      xAxis.tickFormat(d3.time.format("%m/%d"));

      var line = d3.svg.line()
                 .x(function(d) { return x(formatDate.parse(d.date)); })
                 .y(function(d) { return y(d.score) }); 

      var svg = d3.select(".hero-graph").append("svg").attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom).append("g")
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


      

      _.each(a, function(hero) {
        _.each(hero, function(element, index) {
          if(index > 0 && index) {
            svg.append('path').datum(hero.slice(index - 1, index + 1)).attr("class", "line " + slugify(hero[0].name)).attr("d",line)
            .on("mouseover", function(d) {
              $scope.$apply(function() {
                $scope.activeHero = d[0];
              });
            })
            .on("mouseout", function(d) {
              $scope.$apply(function() {
                $scope.activeHero = null;
              });
            })
            .append("svg:title").text(function(d) { 
              var name = d[0].name;
              var firstScore = d[0].score.toFixed(1);
              var secondScore = d[1].score.toFixed(1);
              var delta = (secondScore - firstScore).toFixed(1);
              var cardinality = (delta > 0) ? "+" : "";
              return name + ": " + firstScore + " - " + secondScore + " (" + cardinality + delta + ")";
            })
          }
        });

        _.each(hero, function(h) {
          svg.append("circle").datum(h)
          .attr("cx", function(d) { return x(formatDate.parse(d.date)) })
          .attr("cy", function(d) { return y(d.score) })
          .attr("r", 2)
          .on("mouseover", function(d) {
            $scope.$apply(function() {
              $scope.activeHero = d;
            });
          })
          .on("mouseout", function(d) {
            $scope.$apply(function() {
              $scope.activeHero = null;
            });
          })
          .attr("class", "circle " + slugify(h.name))
          .append("svg:title").text(function(d) { return d.name + ": " + d.score.toFixed(1) })
        })
      });

      svg.append("g").attr("class", "y axis").call(yAxis).append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("Meta Score")

      svg.append("g").attr("class", "x axis")
      .attr("transform", "translate(0, " + height + ")").call(xAxis);

    });
  });

});

