import "./styles/pb.css";

export default function () {
  $("<div>", { id: "dl-bar" })
    .html(
      `</div><div id="dl-progress"></div><span id="dl-info"></span><div id="dl-progress-failed">`,
    )
    .appendTo(".uk-width-expand .uk-margin-left");
  const dl_percentage = `
            <div id="dl-percentage-container">
              <a href="javascript:;" id="dl-percentage" class="animate-click" draggable="false"></a>
            </div>
          `;
  $("body").append(dl_percentage);
}
