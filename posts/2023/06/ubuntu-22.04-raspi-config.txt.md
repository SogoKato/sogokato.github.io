---
title: "Ubuntu 22.04ではusercfg.txtがデフォルトでincludeされていないので注意"
date: "2023-06-14"
tags: ["Ubuntu", "Raspberry Pi"]
---

タイトルの通りです。これにしばらくハマってしまったので戒めのために書いておきます。

## tl;dr

Ubuntu 20.04 の時と同じ設定ファイルをラズパイの /boot/firmware に入れていたけど反映されていなかった。調べてみたらそのファイルを include する文が Ubuntu 22.04 では消されていた。

## そもそも config.txt とは？

> The Raspberry Pi uses a configuration file instead of the BIOS you would expect to find on a conventional PC. The system configuration parameters, which would traditionally be edited and stored using a BIOS, are stored instead in an optional text file named config.txt.
>
> Raspberry Pi は、通常の PC に搭載されている BIOS の代わりに、設定ファイルを使用しています。従来は BIOS を使用して編集・保存されていたようなシステム設定のパラメータは、config.txt というオプションのテキストファイルに代わりに保存されます。

ということです。具体的にどのような値を設定可能なのかについては参考文献にあるリンク先を見てください。

PC で適当に作ったファイルを入れ込んだら最初の虹色の画面で止まってしまったので、書き換える際はいったんコピーしてきて編集してから戻すほうが良さそうです（Windows で作ったファイルだったのでたぶん改行コードの問題）。

## config.txt のファイルを比較してみる

こちらが Ubuntu 20.04

```
# Please DO NOT modify this file; if you need to modify the boot config, the
# "usercfg.txt" file is the place to include user changes. Please refer to
# the README file for a description of the various configuration files on
# the boot partition.

# The unusual ordering below is deliberate; older firmwares (in particular the
# version initially shipped with bionic) don't understand the conditional
# [sections] below and simply ignore them. The Pi4 doesn't boot at all with
# firmwares this old so it's safe to place at the top. Of the Pi2 and Pi3, the
# Pi3 uboot happens to work happily on the Pi2, so it needs to go at the bottom
# to support old firmwares.

[pi4]
kernel=uboot_rpi_4.bin
max_framebuffers=2

[pi2]
kernel=uboot_rpi_2.bin

[pi3]
kernel=uboot_rpi_3.bin

[all]
arm_64bit=1
device_tree_address=0x03000000

# The following settings are "defaults" expected to be overridden by the
# included configuration. The only reason they are included is, again, to
# support old firmwares which don't understand the "include" command.

enable_uart=1
cmdline=nobtcmd.txt

include syscfg.txt
include usercfg.txt
```

こちらが Ubuntu 22.04

```
[all]
kernel=vmlinuz
cmdline=cmdline.txt
initramfs initrd.img followkernel

[pi4]
max_framebuffers=2
arm_boost=1

[all]
# Enable the audio output, I2C and SPI interfaces on the GPIO header. As these
# parameters related to the base device-tree they must appear *before* any
# other dtoverlay= specification
dtparam=audio=on
dtparam=i2c_arm=on
dtparam=spi=on

# Comment out the following line if the edges of the desktop appear outside
# the edges of your display
disable_overscan=1

# If you have issues with audio, you may try uncommenting the following line
# which forces the HDMI output into HDMI mode instead of DVI (which doesn't
# support audio output)
#hdmi_drive=2

# Enable the serial pins
enable_uart=1

# Autoload overlays for any recognized cameras or displays that are attached
# to the CSI/DSI ports. Please note this is for libcamera support, *not* for
# the legacy camera stack
camera_auto_detect=1
display_auto_detect=1

# Config settings specific to arm64
arm_64bit=1
dtoverlay=dwc2

[cm4]
# Enable the USB2 outputs on the IO board (assuming your CM4 is plugged into
# such a board)
dtoverlay=dwc2,dr_mode=host

[all]
include usercfg.txt
```

全然違いますね。`Please DO NOT modify this file` と言わなくなったので config.txt 書き換えていいよってことになったのかもです。私は Ubuntu 20.04 の時に使っていたファイルを入れて「アレ～？」と言っていました。

## 蛇足：なんの設定を入れていたか

[PoE+ HAT](https://www.raspberrypi.com/products/poe-plus-hat/) を使っているのですが、デフォルト設定だと低い温度でもファンが回り始めてうるさいのでファンの設定を変えています。

```
dtoverlay=rpi-poe-plus
dtparam=poe_fan_temp0=50000,poe_fan_temp0_hyst=2000
dtparam=poe_fan_temp1=60000,poe_fan_temp1_hyst=2000
dtparam=poe_fan_temp2=70000,poe_fan_temp2_hyst=2000
dtparam=poe_fan_temp3=80000,poe_fan_temp3_hyst=5000
```

色々デバッグを試していたのですが、それ以前にまったく読まれていなかったというのが恥ずかしいですが、同じところで詰まってしまった誰かのお役に立てれば幸いです・・・。

## 参考文献

* [Raspberry Pi Documentation - The config.txt file](https://www.raspberrypi.com/documentation/computers/config_txt.html)
* [firmware/boot/overlays/README at master · raspberrypi/firmware · GitHub](https://github.com/raspberrypi/firmware/blob/master/boot/overlays/README)
