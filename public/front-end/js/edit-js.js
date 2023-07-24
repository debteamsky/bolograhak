jQuery(function($){

  // /////////////////////////////////////// Nav Menu start
  function sidemenu(){
    $('.nav_sec').toggleClass('slidein');
    $(".nav_sec").find("ul > li").addClass("hover-target");
    $('.nav_sec').prepend('<div class="cls-btn"></div>');
  
    $('.cls-btn').on('click', function(){
        $('.nav_sec').removeClass('slidein');
        $(".nav_sec").find("ul > li").removeClass("hover-target");
    });
  }
  $('body').find('.toggle-menu').on('click',sidemenu);
  
  $('.nav_sec ul > li > ul').parent().prepend('<i class="arw-nav"></i>');
  function subMenu(){
      $(this).parent('li').find('> ul').stop(true, true).slideToggle();
      $(this).parents('li').siblings().find('ul').stop(true, true).slideUp();
      $(this).toggleClass('actv');
      $(this).parent().siblings().find('.arw-nav').removeClass('actv');
  }
  $('.nav_sec ul > li > .arw-nav').on('click',subMenu);
  
  // /////////////////////////////////////// Nav Menu End
  
  // /////////////////////////////////////// Fixed Top Start
  $(window).scroll(function(){
   var scroll = $(window).scrollTop();
   if(scroll >= 50){
    $(".main_header").addClass("fixed-top");
   }else{
    $(".main_header").removeClass("fixed-top");
   }
  });
  
  // /////////////////////////////////////// Fixed Top End
  
  // /////////////////////////////////////// Auto Field Dropdown Start
  $(".search-area input").keyup(function(){
    $(".autofield-dropdown").show();
  })
  
  $(window).click(function(){
    $(".autofield-dropdown").hide();
  });
  // /////////////////////////////////////// Auto Field Dropdown End
  
  
  // /////////////////////////////////////// Slick Slider start
  $('.banner-slider1').slick({
    dots:false,
    infinite: true,
    speed:1800,
    autoplay:true,
    autoplaySpeed: 4000,
    pauseOnHover:false,
    arrows:false,
    fade:true,
    slidesToShow:1,
    slidesToScroll:1
  });
  
  $('.banner-slider2').slick({
    dots:false,
    infinite: true,
    speed:2000,
    autoplay:true,
    autoplaySpeed: 2000,
    pauseOnHover:false,
    arrows:false,
    fade:true,
    slidesToShow:1,
    slidesToScroll:1
  });
  
  $('.banner-slider3').slick({
    dots:false,
    infinite: true,
    speed:1400,
    autoplay:true,
    autoplaySpeed:3000,
    pauseOnHover:false,
    arrows:false,
    fade:true,
    slidesToShow:1,
    slidesToScroll:1
  });
  
  $('.post-slider').slick({
    dots:false,
    infinite: true,
    speed:1000,
    autoplay:false,
    pauseOnHover:false,
    arrows:true,
    prevArrow: '<i class="fa-solid fa-chevron-left slick-arrow-left"></i>',
    nextArrow: '<i class="fa-solid fa-chevron-right slick-arrow-right"></i>',
    slidesToShow:1,
    slidesToScroll:1
  });
  
  $('.gr-slider1').slick({
    dots:false,
    infinite: true,
    speed:1800,
    autoplay:true,
    autoplaySpeed: 4000,
    pauseOnHover:false,
    arrows:false,
    fade:true,
    slidesToShow:1,
    slidesToScroll:1
  });
  
  $('.gr-slider2').slick({
    dots:false,
    infinite: true,
    speed:2000,
    autoplay:true,
    autoplaySpeed: 2000,
    pauseOnHover:false,
    arrows:false,
    fade:true,
    slidesToShow:1,
    slidesToScroll:1
  });
  
  $('.gr-slider3').slick({
    dots:false,
    infinite: true,
    speed:2600,
    autoplay:true,
    autoplaySpeed: 3000,
    pauseOnHover:false,
    arrows:false,
    fade:true,
    slidesToShow:1,
    slidesToScroll:1
  });
  
  $('.gr-slider4').slick({
    dots:false,
    infinite: true,
    speed:3000,
    autoplay:true,
    autoplaySpeed: 5000,
    pauseOnHover:false,
    arrows:false,
    fade:true,
    slidesToShow:1,
    slidesToScroll:1
  });
  
  $('.comment-slider').slick({
    centerMode: true,
    arrows: false,
    speed: 2000,
    dots: false,
    centerPadding: '400px',
    slidesToShow: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    responsive: [
      {
        breakpoint: 1280,
        settings: {
          arrows: false,
          centerMode: true,
          centerPadding: '300px',
          slidesToShow: 1
        }
      },
      {
        breakpoint: 1080,
        settings: {
          arrows: false,
          centerMode: true,
          centerPadding: '200px',
          slidesToShow: 1
        }
      },
  
      {
        breakpoint: 991,
        settings: {
          arrows: false,
          centerMode: true,
          centerPadding: '150px',
          slidesToShow: 1
        }
      },
      {
        breakpoint: 768,
        settings: {
          arrows: false,
          centerMode: true,
          centerPadding: false,
          slidesToShow: 2
        }
      },
      {
        breakpoint: 640,
        settings: {
          arrows: false,
          centerMode: false,
          centerPadding: false,
          slidesToShow: 1
        }
      }
    ]
  });
  
  $('.v-slider').slick({
    dots:true,
    infinite: true,
    speed:1800,
    autoplay:false,
    arrows:false,
    autoplaySpeed: 4000,
    slidesToShow:1,
    slidesToScroll:1
  });
  
  $('.featured-slider').slick({
    slidesToShow: 5,
    slidesToScroll: 1,
    autoplay: true,
    arrows:false,
    dots:false,
    autoplaySpeed: 3000,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 4,
          slidesToScroll: 1,
          infinite: true,
          dots: false
        }
      },
      {
        breakpoint: 890,
        settings: {
          slidesToShow: 3,
          slidesToScroll: 1
        }
      },
      {
        breakpoint: 620,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1
        }
      },
      {
        breakpoint: 440,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1
        },
      }
      // You can unslick at a given breakpoint now by adding:
      // settings: "unslick"
      // instead of a settings object
    ]
  });
  
  
  
  // /////////////////////////////////////// Slick Slider end
  
  
  // /////////////////////////////////////// language Select start
  $(".lang-arw").click(function(e){
    e.preventDefault();
    $(".lang-dropdown").slideToggle();
  });
  
  //SELECT OPTIONS AND HIDE OPTION AFTER SELECTION
  $(".lang-dropdown ul li a").click(function(e) {
    e.preventDefault();
      var text = $(this).html();
      $(".language-select").find(".lang-change").html(text);
      $(".language-select").find(".lang-dropdown").slideUp();
  }); 
  
  //HIDE OPTIONS IF CLICKED ANYWHERE ELSE ON PAGE
  $(document).bind('click', function(e) {
      var $clicked = $(e.target);
      if (! $clicked.parents().hasClass("language-select"))
          $(".lang-dropdown").slideUp();
  });
  
  // /////////////////////////////////////// language Select end
  
  // /////////////////////////////////////// Load More Blog slice Start
  $(".more-blog-btn").click(function(e){
    e.preventDefault();
    $(".load-blogs-slice").slice(0,1).fadeIn().css("margin-top" , "40px");
    $(this).hide();
    $(".blog-slice-btn").show();
    $(".blog-slice-btn .view-more").click(function(e){
    e.preventDefault();
    $(".load-blogs-slice:hidden").slice(0,1).fadeIn();
    if($(".load-blogs-slice:hidden").length == 0){
         $(".blog-slice-btn").hide();
        }
    });
   });
  
  $(".accordion-repeat").slice(0,6).show();
    $(".load-slice-btn").click(function(e){
      e.preventDefault();
      $(".accordion-repeat:hidden").slice(0,6).fadeIn("slow");
      
      if($(".accordion-repeat:hidden").length == 0){
         $(".load-slice-btn").hide();
        }
    });
  
  // /////////////////////////////////////// Load More Blog slice end
  
  // /////////////////////////////////////// Archive Slide Start
  $(".archive-slide").click(function(e){
    e.preventDefault();
    $(".archive-dropdwn").slideToggle();
  });
  // /////////////////////////////////////// Archive Slide end
  
  // /////////////////////////////////////// search Box open start
  $(".search-pop").click(function(e) {
    e.preventDefault()
    $("#search-box").addClass("-open").fadeIn();
    setTimeout(function() {
    inputSearch.focus();
    }, 800);
    });
  
    $('a[href="#close"]').click(function(e) {
    e.preventDefault()
    $("#search-box").removeClass("-open").fadeOut();
    });
  
    $(document).keyup(function(e) {
    if (e.keyCode == 27) { // escape key maps to keycode `27`
    $("#search-box").removeClass("-open");
    }
  });
  // /////////////////////////////////////// search Box open end
  
   // /////////////////////////////////////// Tooltip Start
    // var a = 0;
    //   $(window).scroll(function() {
  
    //     var oTop = $('.about-content').offset().top - window.innerHeight;
    //     // Md.Asaduzzaman Muhid
    //     if (a == 0 && $(window).scrollTop() > oTop) {
    //       $(".tooltip-pop").fadeIn();
    //       a = 1;// Md.Asaduzzaman Muhid
    //     }
    //   });
   // /////////////////////////////////////// Tooltip End
  
   // /////////////////////////////////////// Modal Start
    $(".autofield-dropdown ul > li").click(function(){
      $(".custom-modal").fadeIn();
    });
  
    $(".custom-modal-close").click(function(e){
      e.preventDefault();
      $(".custom-modal").fadeOut();
    });
  
    $(".login").click(function(e){
      e.preventDefault();
      $(".login-modal").fadeIn();
      $('.nav_sec').removeClass('slidein');
  
      $(".login-modal-close").click(function(e){
       e.preventDefault();
       $(".login-modal").fadeOut(); 
      });
  
    });
  
    $(window).load(function(){ 
      setTimeout(function () {
          $("#quickloginmodal").modal('show');
      }, 10000); 
     }); 
  
    $(".quicklog").click(function(e){
      e.preventDefault();
      $("#quickloginmodal").modal('hide');
      $(".login-modal").fadeIn();
      $(".login-modal-close").click(function(e){
       e.preventDefault();
       $(".login-modal").fadeOut(); 
      });
    });
   // /////////////////////////////////////// Modal End
  
  // /////////////////////////////////////// Password eye hide show Start
    $('.eye-change').click(function(){
         
        if($(this).hasClass('fa-eye-slash')){
           
          $(this).removeClass('fa-eye-slash');
          
          $(this).addClass('fa-eye');
          
          $(this).parents(".custom-form").find('.password').attr('type','text');
            
        }else{
         
          $(this).removeClass('fa-eye');
          
          $(this).addClass('fa-eye-slash');  
          
          $(this).parents(".custom-form").find('.password').attr('type','password');
        }
    });
  // /////////////////////////////////////// Password eye hide show End
  
    ////////////////////////////// Accordion Start
  
  $(".custom-accordion").on("click", ".acc_heading", function() {
      $(this).toggleClass("active").next().slideToggle();
      $(this).parent(".c_accordion_wrap").addClass("yellow-border");
      $(".acc_contents").not($(this).next()).slideUp(300);
      $(".acc_contents").not($(this).next()).parent(".c_accordion_wrap").removeClass("yellow-border");
      $(this).parents('.accordion-repeat').siblings().find('.acc_heading').removeClass("active");
    });
  
  ////////////////////////////// Accordion End
  
  ////////////////////////////// Tooltip Start
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
  ////////////////////////////// Tooltip End
  
  // ////////////////////////////// Range Slider Start
  
   const rangeTexts = {
      0: "Lowest",
      0.5: "Low",
      1: "Not Bad",
      1.5: "Medium",
      2: "Average",
      2.5: "Good",
      3: "Very Good",
      3.5: "Awesome",
      4: "Exellent",
      4.5: "High",
      5: "Highest",
    };
  
    const rangeEmojis = {
      0: "😠",
      0.5: "😦",
      1: "☹️",
      1.5: "🙁",
      2: "😐",
      2.5: "🙂",
      3: "😊",
      3.5: "😄",
      4: "😃",
      4.5: "😍",
      5: "🤩",
    };
  
    $("#rating-range").slider({
      step: 0.5,
      range: true, 
      min: 0, 
      max: 5, 
      values: [0, 5], 
      slide: function(event, ui)
      {
        $("#ratingRange").val(ui.values[0] + " / " + ui.values[1]);
        // When slider values change, update the text
        $("#selected-range-text").text(rangeTexts[ui.values[0]]);
        $("#selected-range-emojis").text(rangeEmojis[ui.values[0]]);
      }
      });
      $("#ratingRange").val($("#rating-range").slider("values", 0) + " / " + $("#rating-range").slider("values", 1));
  
  ////////////////////////////// Range Slider End
  
  
  });
    
  
  
    
    
    
    
    
    
    
    