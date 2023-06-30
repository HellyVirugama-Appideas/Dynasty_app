$(document).ready(function () {
	"use strict";
	
   var carousel = $("#screenshot-carousel");

   carousel.owlCarousel({
        items : 5,
        lazyLoad : true,
        navigation : true,
        navigationText : ["prev", "next"],
        pagination: true,
        paginationNumbers: true,
        responsive: true,
        afterAction: function (el) {
            //remove class active
            this
            .$owlItems
            .removeClass('active')

            //add class active
            this
            .$owlItems //owl internal $ object containing items
            .eq(this.currentItem + 2)
            .addClass('active')    
        } 
    });
    
    //App Reviews
    $("#app-reviews").owlCarousel({
        items : 1,
        itemsDesktop : [1199, 1],
        itemsDesktopSmall : [980, 1],
        itemsTablet: [768, 1],
        itemsTabletSmall: true,
        itemsMobile : [479, 1],
        paginationNumbers: true,
        transitionStyle: "backSlide",
    });
    
    //Sticky Nav
    $("#main-nav").sticky({topSpacing:0});
    
    //Smooth Scroll
    smoothScroll.init();
    
	//Scroll Spy
	$('body').scrollspy({ target: '#main-nav' })
		
    //menu-active item
    var navlnks = document.querySelectorAll(".navbar-nav a");
    Array.prototype.map.call(navlnks, function(item) {

        item.addEventListener("click", function(e) {

            var navlnks = document.querySelectorAll(".nav a"); 

            Array.prototype.map.call(navlnks, function(item) {

                if (item.parentNode.className == "active" || item.parentNode.className == "active open" ) {

                    item.parentNode.className = "";

                } 

            }); 

            e.currentTarget.parentNode.className = "active";
        });
    });


    $('#mc-form').ajaxChimp({
        callback: mailchimpCallback,
        url: "http://blahblah.us13.list-manage.com/subscribe/post?u=1dc1b222717db8f0b81b0ed9c&id=5c4f4f89aa"
    });

    function mailchimpCallback(resp) {
        alert("We have sent you a confirmation email!");
    }
	
	//WOW JS
	new WOW().init();
   
});





