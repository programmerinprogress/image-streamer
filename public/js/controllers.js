angular.module('imageStreamerApp', ['ngAnimate']).
controller('ImageStreamerCtrl', ['$scope', '$http', '$interval', 'HashtagService', function($scope, $http, $interval, HashtagService) {

  // instantiate socket IO
  $scope.socket = io();

  $scope.hashtags = HashtagService.hashtags;

  $scope.token = null;

  $interval(function() {
    // let server know we're still interested in the hastags we have
    var activeTags = [];

    angular.forEach($scope.hashtags, function(value, key) {
      this.push(value.name);
    }, activeTags);

    if (activeTags.length > 0) {
      // send tags (if we have any) every 30 seconds to ensure we still need to subscribe to them
      $http({
        withCredentials: false,
        method: 'post',
        url: '../api/tag/heartbeat',
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          "tags": activeTags
        }
      }).success(function(response) {
        console.log('tag added!');
      });

    }

  }, 30000);

  $scope.addHashtag = function() {
    // create blank list first, awaiting values to stream in
    $scope.hashtags.push({
      'name': $scope.newHashtag,
      'images': [],
      'lasttimestamp': 0
    });

    // let the API know that we want these tags
    $http({
      withCredentials: false,
      method: 'post',
      url: '../api/tag',
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        "hashtag": $scope.newHashtag
      }
    }).success(function(response) {
      console.log('tag added!');
    });

    $scope.newHashtag = "";

  };

  $scope.removeHashtag = function(tag) {
    var deletedTag = $scope.hashtags.splice($scope.hashtags.indexOf(tag), 1);
  };

  $scope.isAuthenticated = function() {
    var cookies = document.cookie.split(';');
    $scope.token = null;

    for (var j = 0; j < cookies.length; j++) {
      if (cookies[j].indexOf('access_token=') > -1) {
        $scope.token = cookies[j].replace('access_token=', '');
      }
      break;
    }

    return $scope.token !== null;
  };

  $scope.updateStream = function(tag) {
    for (var i = 0; i < $scope.hashtags.length; i++) {
      if ($scope.hashtags[i].name == tag) {

        if ($scope.isAuthenticated()) {
          // make JSONP call to get around CORS and get latest stream of images for a given tag
          $http.jsonp('https://api.instagram.com/v1/tags/' + tag + '/media/recent?access_token=' + $scope.token + '&callback=JSON_CALLBACK&count=1&min_tag_id=' + $scope.hashtags[i].lastid)
            .success(function(data) {
              // obtain tag name
              var currentTag = data.pagination.next_url.match(/(tags\/){1}([A-z0-9])+(\/media\/){1}/gi)[0].replace('tags/', '').replace('/media/', '');

              for (var j = 0; j < $scope.hashtags.length; j++) {
                if ($scope.hashtags[j].name == currentTag) {
                  for (var i = 0; i < data.data.length; i++) {

                    // if we've already had this id, wait until next, we also need to make sure we don't have an older id or we risk repeats in the stream
                    if (typeof $scope.hashtags[j].lastid == 'undefined' || $scope.hashtags[j].lastid < data.data[i].id) {
                      // limit our carousel, taking older photos off first (first-in last-out )
                      if ($scope.hashtags[j].images.length > 3) {
                        $scope.hashtags[j].images.pop();
                      }
                      $scope.hashtags[j].images.unshift({
                        'src': data.data[i].images.low_resolution.url
                      });
                      // make note of timestamp for sending to api
                      $scope.hashtags[j].lastid = data.data[i].id;
                    }

                  }
                  break;
                }
              }

            });

        }


        break;
      }
    }

  };

  // socket IO events (event when we receive a new image update)
  $scope.socket.on('new recent image', function(data) {
    for (var i = 0; i < data.length; i++) {
      $scope.updateStream(data[i].object_id);
    }
  });


}]);
