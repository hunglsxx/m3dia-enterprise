function clear() {
    $('.progress').hide();

    $('#m3dia-progress').css('width', `0%`);
    $('#m3dia-progress').html(`0%`);

    $("#m3dia-result").hide();
    $('#m3dia-result').attr('href', '');
    $('#m3dia-result img').attr('src', "");

}

window.m3dia.on('ffmpeg-start', function(command) {
    $('.progress').show();
});

window.m3dia.on('ffmpeg-progress', function(progress) {
    if(progress.percent) {
        $('#m3dia-progress').css('width', `${progress.percent}%`);
        $('#m3dia-progress').html(`${progress.percent.toFixed(2)}%`);
    }
});

window.m3dia.on('ffmpeg-error', function(error, stdout, stderr) {
    console.log('error', error, stdout, stderr);
    $('#m3dia-convert').prop('disabled', false);
});

window.m3dia.on('ffmpeg-end', function(data) {
    $('#m3dia-progress').css('width', `100%`);
    $('#m3dia-progress').html(`100%`);

    $('#m3dia-result a').attr('href', `file://${data.outputPath}`);
    $('#m3dia-result input').val(`${data.outputPath}`)
    $('#m3dia-result').show();

    $('#m3dia-convert').prop('disabled', false);
});

window.m3dia.on('ffmpeg-screenshot', function(base64) {
    $('#m3dia-result img').attr('src', `data:image/png;base64, ${base64}`);
});

$('#m3dia-convert').click(async () => {
    let files = $("#m3dia-file").prop('files');
    if(files && files.length) {
        $('#m3dia-convert').prop('disabled', true);
        await window.m3dia.convert(files[0].path);
    }
});

$("#m3dia-file").on('change', () => {
    clear();
});

