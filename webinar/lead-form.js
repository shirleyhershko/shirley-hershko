/* The Meta pixel and the lead forms, shared by every page in this folder.
   sendLead(form, page, stay) passes a registration to /api/lead, which hands it to Wix.
   It never blocks the visitor: after 4 seconds at most it answers, sent or not. */
(function(w,d){
  /* the Meta pixels: Shirley's main pixel, which the webinar campaign counts on (as Mor asked),
     and the agency's pixel (the one on drshirleyhershko.com), kept as it was until the agency says it no longer needs it */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(w,d,"script","https://connect.facebook.net/en_US/fbevents.js");
  fbq("init","2153966398696218");
  fbq("init","1874752147018374");
  fbq("track","PageView");

  /* a registration made just before landing here (the webinar forms move on to the thank you page) counts as a Lead here */
  try{ var done=sessionStorage.getItem("lp_lead"); if(done){ sessionStorage.removeItem("lp_lead"); fbq("track","Lead",{content_name:done}); } }catch(e){}

  /* where the visitor came from: the utm_ tags of the ad link, kept for the whole visit */
  var KEYS=["utm_source","utm_medium","utm_campaign","utm_content","utm_term"], q=new URLSearchParams(location.search), utm={};
  try{ utm=JSON.parse(sessionStorage.getItem("lp_utm")||"{}")||{}; }catch(e){}
  if(KEYS.some(function(k){ return q.get(k); })){
    utm={}; KEYS.forEach(function(k){ utm[k]=q.get(k)||""; });
    try{ sessionStorage.setItem("lp_utm",JSON.stringify(utm)); }catch(e){}
  }

  /* a hidden field that people never see and bots fill in */
  function trap(form){
    if(form.querySelector('[name="website"]')) return;
    var i=d.createElement("input");
    i.type="text"; i.name="website"; i.tabIndex=-1; i.autocomplete="off"; i.setAttribute("aria-hidden","true");
    i.style.cssText="position:absolute;width:1px;height:1px;padding:0;border:0;margin:-1px;overflow:hidden;clip-path:inset(50%);opacity:0;pointer-events:none";
    form.appendChild(i);
  }
  [].forEach.call(d.querySelectorAll("[data-seat]"),trap);

  w.sendLead=function(form,page,stay){
    function v(n){ var el=form.querySelector('[name="'+n+'"]'); return !el?"":el.type==="checkbox"?el.checked:el.value.trim(); }
    var body={
      name:v("name"), phone:v("phone"), email:v("email"), consent:v("consent")===true, website:v("website"),
      page:page, pageUrl:location.origin+location.pathname,
      utmSource:utm.utm_source||"", utmMedium:utm.utm_medium||"", utmCampaign:utm.utm_campaign||"", utmContent:utm.utm_content||"", utmTerm:utm.utm_term||""
    };
    var sent=fetch("/api/lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),keepalive:true})
      .then(function(r){ return r.ok; },function(){ return false; });
    var late=new Promise(function(r){ setTimeout(function(){ r(false); },4000); });
    /* a Lead is counted only once Wix has saved the registration, as Mor asked */
    return Promise.race([sent,late]).then(function(ok){
      if(ok){
        if(stay) fbq("track","Lead",{content_name:page});
        else try{ sessionStorage.setItem("lp_lead",page); }catch(e){}
      }
      return ok;
    });
  };
})(window,document);
